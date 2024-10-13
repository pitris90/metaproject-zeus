import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { AttributeType } from '../attribute-type';
import { ResourceToAttributeType } from './resource-to-attribute-type';

@Entity()
export class ResourceAttributeType {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	name: string;

	@Column({ default: false })
	isPublic: boolean;

	@Column({ default: false })
	isRequired: boolean;

	@ManyToOne(() => AttributeType)
	attributeType: AttributeType;

	@Column()
	attributeTypeId: number;

	@Column(() => TimeEntity)
	time: TimeEntity;

	@OneToMany(() => ResourceToAttributeType, resourceToAttributeType => resourceToAttributeType.resourceAttributeType)
	resourceToResourceAttributes: ResourceToAttributeType[];
}