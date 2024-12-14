import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface EntitySeederInterface<T> {
	getInsertEntity(): string;

	getInsertElements(): Promise<QueryDeepPartialEntity<T>[]>;
}
