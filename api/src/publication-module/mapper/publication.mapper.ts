import { Injectable } from '@nestjs/common';

@Injectable()
export class PublicationMapper {
	public mapWorkApiResponseToDto(data: any) {
		return {
			title: data.message.title[0],
			authors: data.message.author.map((author: any) => author.given + ' ' + author.family).join(', '),
			year: data.message.created['date-parts'][0][0],
			uniqueId: data.message.DOI,
			journal: data.message['container-title'][0]
		};
	}
}
