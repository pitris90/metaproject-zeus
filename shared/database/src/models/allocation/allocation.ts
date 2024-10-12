import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimeEntity } from '../time-entity';
import { Project } from '../project/project';
import { Resource } from '../resource/resource';
import { AllocationStatus } from '../../enums/allocation.status';

@Entity()
export class Allocation {
	@PrimaryGeneratedColumn()
	id: number;

	@Column("text")
	justification: string;

	@Column({ nullable: true })
	description: string;

	@Column()
	quantity: number;

	@Column()
	projectId: number;

	@Column()
	resourceId: number;

	@Column()
	status: AllocationStatus;

	@Column({ nullable: true, type: "date" })
	startDate: Date;

	@Column({ nullable: true, type: "date" })
	endDate: Date;

	@Column({ default: false })
	isLocked: boolean;

	@Column({ default: true})
	isChangeable: boolean;

	@Column(() => TimeEntity)
	time: TimeEntity;

	@ManyToOne(() => Project)
	project: Project;

	@ManyToOne(() => Resource)
	resource: Resource;
}