import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('getArticle')
  async getArticle(): Promise<string> {
    return await this.appService.getArticle();
  }

  @Get('getChatOpenAI')
  async getChatOpenAI(): Promise<string> {
    return await this.appService.getChatOpenAI();
  }

  @Get('retrievalQAChain')
  async retrievalQAChain(): Promise<string> {
    return await this.appService.retrievalQAChain();
  }

  @Get('retrievalQAChainSimple')
  async retrievalQAChainSimple(): Promise<string> {
    return await this.appService.retrievalQAChainSimple();
  }

  @Get('loaderPdf')
  async loaderPdf(): Promise<string> {
    return await this.appService.loaderPdf();
  }

  @Get('loaderGithub')
  async loaderGithub(): Promise<string> {
    return await this.appService.loaderGithub();
  }

  @Get('loaderHtml')
  async loaderHtml(): Promise<string> {
    return await this.appService.loaderHtml();
  }

  @Get('textSplitter')
  async textSplitter(): Promise<string> {
    return await this.appService.textSplitter();
  }

  @Get('textSplitter2')
  async textSplitter2(): Promise<string> {
    return await this.appService.textSplitter2();
  }

  @Get('textSplitterMarkdown')
  async textSplitterMarkdown(): Promise<string> {
    return await this.appService.textSplitterMarkdown();
  }
}
