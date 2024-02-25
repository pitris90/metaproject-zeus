import { EntityTarget } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface EntitySeederInterface<T> {
	getInsertEntity(): EntityTarget<T>;

	getInsertElements(): Promise<QueryDeepPartialEntity<T>[]>;
}
