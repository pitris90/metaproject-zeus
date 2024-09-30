import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Resource } from './resource';
import { ResourceAttributeType } from './resource-attribute-type';

@Entity()
export class ResourceToAttributeType {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	resourceId: number;

	@Column()
	resourceAttributeTypeId: number;

	@Column(() => TimeEntity)
	time: TimeEntity;

	@Column()
	value: string;

	@ManyToOne(() => Resource, resource => resource.resourceToResourceAttributes)
	resource: Resource;

	@ManyToOne(() => ResourceAttributeType, resourceAttributeType => resourceAttributeType.resourceToResourceAttributes)
	resourceAttributeType: ResourceAttributeType;
}