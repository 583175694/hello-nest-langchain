import 'dotenv/config';
// import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { PromptTemplate } from 'langchain/prompts';
import { SimpleSequentialChain, LLMChain } from 'langchain/chains';
import { OpenAI } from 'langchain/llms/openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanChatMessage } from 'langchain/schema';
import { RetrievalQAChain } from 'langchain/chains';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { loadQAStuffChain } from 'langchain/chains';
import { Document } from 'langchain/document';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { GithubRepoLoader } from 'langchain/document_loaders/web/github';
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio';
import { HtmlToTextTransformer } from 'langchain/document_transformers/html_to_text';
import {
  RecursiveCharacterTextSplitter,
  CharacterTextSplitter,
  MarkdownTextSplitter,
} from 'langchain/text_splitter';
import { NotionLoader } from 'langchain/document_loaders/fs/notion';

import * as fs from 'fs';

const LOCAL_VENCTOR_DATA_PATH = './vectorData/';

const baseOptions = {
  proxy: {
    host: '127.0.0.1',
    port: 7890,
  },
};

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  // 基础问答
  async getChatOpenAI(): Promise<string> {
    const chat = new ChatOpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        verbose: true,
      },
      {
        baseOptions,
      },
    );

    // 1. 聊天模型: 消息作为输入， 消息作为输出
    // 使用chat.call方法执行一个聊天对话，并获取生成的响应结果
    const response = await chat.call([
      // 人类消息，指定了需要翻译的文本"I love programming."
      new HumanChatMessage(
        'Translate this sentence from English to Chinese. I love programming.',
      ),
    ]);

    return response.content;
  }

  // 写作
  async getArticle(): Promise<string> {
    // 2.通过LangChain使用OpenAI
    // 这是一个用于根据戏剧标题撰写摘要的 LLMChain。
    const llm = new OpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
      },
      {
        baseOptions,
      },
    );
    const template = `你是一名剧作家。根据戏剧标题，你的任务是为该标题写一个摘要。

    标题：{title}
    剧作家：这是上述戏剧的摘要：`;
    const promptTemplate = new PromptTemplate({
      template,
      inputVariables: ['title'],
    });
    const synopsisChain = new LLMChain({ llm, prompt: promptTemplate });

    // 这是一个用于根据摘要撰写戏剧评论的 LLMChain。
    const reviewLLM = new OpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
      },
      {
        baseOptions,
      },
    );
    const reviewTemplate = `你是《纽约时报》的戏剧评论家。根据戏剧摘要，你的任务是为该戏剧写一篇评论。

    戏剧摘要：
    {synopsis}
    《纽约时报》戏剧评论家对上述戏剧的评论：`;
    const reviewPromptTemplate = new PromptTemplate({
      template: reviewTemplate,
      inputVariables: ['synopsis'],
    });
    const reviewChain = new LLMChain({
      llm: reviewLLM,
      prompt: reviewPromptTemplate,
    });

    const overallChain = new SimpleSequentialChain({
      chains: [synopsisChain, reviewChain],
      verbose: true,
    });
    const review = await overallChain.run('日落海滩上的悲剧');
    console.log(review);
    /*
        变量 review 包含基于第一步生成的输入标题和摘要的戏剧评论：

        "《日落海滩上的悲剧》是一个充满力量和感动的故事，涵盖了爱情、失落和救赎。该剧讲述了年轻恋人杰克和吉尔的故事，他们计划一起的未来被杰克在一次车祸中的意外死亡所打断。剧情追随吉尔在应对悲痛时的挣扎，最终她在另一名男子的怀抱中找到了安慰。
        该剧文笔优美，演员们的表演也令人赞叹。他们用深情的表演赋予角色生命，观众在情感之旅中与吉尔一同面对悲伤，她必须在过去和未来之间做出艰难的决定。剧情达到高潮，将观众带入情感洪流中。
        总体而言，《日落海滩上的悲剧》是一个充满力量和感动的故事，落幕后将在观众心头留下久久不散的印记。对于寻求情感激荡和发人深省体验的人来说，这是一部必看的佳作。"
    */

    return review;
  }

  // 问答
  async retrievalQAChain(): Promise<string> {
    // 初始化用于回答问题的 LLM。
    const model = new OpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
        verbose: true,
      },
      {
        baseOptions,
      },
    );
    try {
      const text = fs.readFileSync('src/data/state_of_the_union.txt', 'utf8');
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
      });
      const docs = await textSplitter.createDocuments([text]);

      // 从文档创建一个向量存储。
      const vectorStore = await HNSWLib.fromDocuments(
        docs,
        new OpenAIEmbeddings(
          {
            verbose: true,
            openAIApiKey: process.env.OPENAI_API_KEY,
          },
          {
            baseOptions,
          },
        ),
      );

      // 初始化完数据库后，存成本地文件
      await vectorStore.save(LOCAL_VENCTOR_DATA_PATH);
      console.log('向量数据库初始化成功!');

      // 初始化一个围绕向量存储的检索器包装器
      const vectorStoreRetriever = vectorStore.asRetriever();

      // 创建一个链条，该链条使用 OpenAI LLM 和 HNSWLib 向量存储。
      const chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);
      const res = await chain.call({
        query: '用中文概括这篇文章的主要内容。',
      });
      console.log({ res });
      return res.text;
    } catch (error) {
      return null;
    }
  }

  // 简单文档问答
  async retrievalQAChainSimple(): Promise<string> {
    // 第一个示例使用 `StuffDocumentsChain`。`
    const llmA = new OpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
        verbose: true,
      },
      {
        baseOptions,
      },
    );
    const chainA = loadQAStuffChain(llmA);
    const docs = [
      new Document({ pageContent: 'Harrison 去了哈佛大学。' }),
      new Document({ pageContent: 'Ankush 去了普林斯顿大学。' }),
    ];
    const resA = await chainA.call({
      input_documents: docs,
      question: 'Harrison 去了哪个大学？',
    });
    console.log({ resA });
    // { resA: { text: ' Harrison 去了哈佛大学。' } }
    return resA.text;
  }

  // 加载pdf
  async loaderPdf(): Promise<string> {
    const loader = new PDFLoader('src/data/第一回：Matplotlib初相识.pdf');
    const pages = await loader.load();
    return pages[0].pageContent;
  }

  // 加载github
  async loaderGithub(): Promise<string> {
    // 使用GithubRepoLoader加载指定GitHub仓库
    const loader = new GithubRepoLoader(
      'https://github.com/hwchase17/langchainjs',
      {
        branch: 'main', // 指定加载main分支
        recursive: false, // 不递归加载子目录
        unknown: 'warn', // 对未知文件类型警告
      },
    );
    // 加载仓库中的文件
    const pages = await loader.load();
    // 返回处理后的第一篇文档内容
    return pages[0].pageContent;
  }

  // 加载html
  async loaderHtml(): Promise<string> {
    // 使用CheerioWebBaseLoader加载目标网页
    const loader = new CheerioWebBaseLoader(
      'https://baijiahao.baidu.com/s?id=1775348893874977945',
    );
    // 加载网页内容
    const docs = await loader.load();
    // 创建一个文本分割器,处理HTML
    const splitter = RecursiveCharacterTextSplitter.fromLanguage('html');
    // 创建一个HTML到纯文本的转换器
    const transformer = new HtmlToTextTransformer();
    // 将分割器和转换器组合成一个流水线
    const sequence = splitter.pipe(transformer);
    // 对加载的网页内容应用流水线,转化为纯文本
    const newDocuments = await sequence.invoke(docs);
    // 返回处理后的第一篇文档内容
    return newDocuments[0].pageContent;
  }

  // 基于字符分割
  async textSplitter(): Promise<string> {
    // 短句分割
    const chunkSize = 20;
    const chunkOverlap = 4;
    const r_splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    const c_splitter = new CharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separator: '，',
    });
    const text =
      '在AI的研究中，由于大模型规模非常大，模型参数很多，在大模型上跑完来验证参数好不好训练时间成本很高，所以一般会在小模型上做消融实验来验证哪些改进是有效的再去大模型上做实验。';
    const r_splits = await r_splitter.splitText(text);
    const c_splits = await c_splitter.splitText(text);

    console.log({ r_splits, c_splits });

    return null;
  }

  // 长文本分割
  async textSplitter2(): Promise<string> {
    // 长文本分割
    const text_2 = `在编写文档时，作者将使用文档结构对内容进行分组。
这可以向读者传达哪些想法是相关的。 例如，密切相关的想法
是在句子中。 类似的想法在段落中。 段落构成文档。

段落通常用一个或两个回车符分隔。
回车符是您在该字符串中看到的嵌入的“反斜杠 n”。

句子末尾有一个句号，但也有一个空格。
并且单词之间用空格分隔`;
    const chunkSize = 100;
    const chunkOverlap = 0;
    const r_splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '(?<=。 )', ' ', ''],
    });
    const c_splitter = new CharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separator: ' ',
    });
    const r_splits = await r_splitter.splitText(text_2);
    const c_splits = await c_splitter.splitText(text_2);

    console.log({ r_splits, c_splits });
    return null;
  }

  // 基于markdown分割
  async textSplitterMarkdown(): Promise<string> {
    // 创建NotionLoader加载指定Notion页面
    const notionLoader = new NotionLoader('src/data/浏览器本地存储');

    // 加载Notion页面内容
    const docs = await notionLoader.load();

    // 取出第一篇文档的内容
    const text = docs[0].pageContent;

    // 设置分割参数
    const chunkSize = 100;
    const chunkOverlap = 0;

    // 创建Markdown文本分割器
    const markdownSplitter = new MarkdownTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    // 使用分割器分割文档文本
    const splits = await markdownSplitter.splitText(text);

    console.log(splits);

    // 使用<br>标签拼接分割后的文本
    return splits.join('<br><br>');
  }
}
