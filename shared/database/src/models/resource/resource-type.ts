import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Resource } from './resource';

@Entity()
export class ResourceType {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	name: string;

	@Column("text")
	description: string;

	@OneToMany(() => Resource, resource => resource.resourceType)
	resources: Resource;

	@Column(() => TimeEntity)
	time: TimeEntity;
}