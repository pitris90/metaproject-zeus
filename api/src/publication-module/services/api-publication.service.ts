import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PublicationDto } from '../dto/publication.dto';
import { PublicationNotFoundApiException } from '../../error-module/errors/publications/publication-not-found.api-exception';
import { PublicationMapper } from '../mapper/publication.mapper';

@Injectable()
export class ApiPublicationService {
	private readonly mailTo: string;

	constructor(
		private readonly httpService: HttpService,
		configService: ConfigService,
		private readonly publicationMapper: PublicationMapper
	) {
		const mailTo = configService.get<string>('API_PUBLICATION_MAIL_TO');

		if (!mailTo) {
			throw new Error('API_PUBLICATION_MAIL_TO is not defined in the environment');
		}

		this.mailTo = mailTo;
	}

	async getPublicationByDoi(doi: string): Promise<PublicationDto> {
		const source$ = this.getCrossRefResponse(`works/${doi}`, 'GET');
		try {
			const response = await lastValueFrom(source$);
			return this.publicationMapper.mapWorkApiResponseToDto(response.data);
		} catch (error) {
			const response = error?.response;

			if (!response) {
				throw error;
			}

			if (response.status === 404) {
				throw new PublicationNotFoundApiException();
			}

			throw error;
		}
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
