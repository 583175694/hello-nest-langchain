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
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
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

  async getChatOpenAI(): Promise<string> {
    const chat = new ChatOpenAI(
      {
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
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
      const text = fs.readFileSync('state_of_the_union.txt', 'utf8');
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
}
