import { DataSource } from 'typeorm';
import { User } from 'resource-manager-database/dist/models/user/user';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersModel {
	constructor(private readonly dataSource: DataSource) {}

	async findUserById(id: number): Promise<User | null> {
		return this.dataSource.getRepository(User).findOneBy({
			id
		});
	}
}
