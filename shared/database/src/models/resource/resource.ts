import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { ResourceType } from './resource-type';
import { ResourceToAttributeType } from './resource-to-attribute-type';

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

	@Column()
	resourceTypeId: number;

	@ManyToOne(() => Resource, resource => resource.childResources, {nullable: true})
	parentResource: Resource;

	@Column({ nullable: true })
	parentResourceId: number;

	@OneToMany(() => Resource, resource => resource.parentResource)
	childResources: Resource[];

	@Column(() => TimeEntity)
	time: TimeEntity;

	@OneToMany(() => ResourceToAttributeType, resourceToResourceAttributes => resourceToResourceAttributes.resource)
	resourceToResourceAttributes: ResourceToAttributeType[];
}