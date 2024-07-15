import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PublicationDto } from '../dto/publication.dto';

@Injectable()
export class ApiPublicationService {
	private readonly mailTo: string;

	constructor(
		private readonly httpService: HttpService,
		configService: ConfigService
	) {
		const mailTo = configService.get<string>('API_PUBLICATION_MAIL_TO');

		if (!mailTo) {
			throw new Error('API_PUBLICATION_MAIL_TO is not defined in the environment');
		}

		this.mailTo = mailTo;
	}

	async getPublicationByDoi(doi: string): Promise<PublicationDto> {
		const source$ = this.getCrossRefResponse(`works/${doi}`, 'GET');
		const response = await lastValueFrom(source$);
		const data = response.data;

		return {
			title: data.message.title[0],
			authors: data.message.author.map((author: any) => author.given + ' ' + author.family).join(', '),
			year: data.message.created['date-parts'][0][0],
			uniqueId: data.message.DOI,
			journal: data.message['container-title'][0]
		};
	}

	private getCrossRefResponse = (url: string, method: 'GET') => {
		return this.httpService.request({
			url: 'https://api.crossref.org/' + url,
			method,
			headers: {
				'User-Agent': `ResourceManager/1.0 (mailto:${this.mailTo})`
			}
		});
	};
}
