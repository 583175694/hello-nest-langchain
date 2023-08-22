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
}
