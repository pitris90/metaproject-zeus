import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { ResourceType } from './resource-type';

@Entity()
export class Resource {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	name: string;

	@Column("text")
	description: string;

	@Column({ default: true })
	isAvailable: boolean;

	@ManyToOne(() => ResourceType, resourceType => resourceType.resources)
	resourceType: ResourceType;

	@ManyToOne(() => Resource, resource => resource.childResources, {nullable: true})
	parentResource: Resource;

	@OneToMany(() => Resource, resource => resource.parentResource)
	childResources: Resource[];

	@Column(() => TimeEntity)
	time: TimeEntity;
}