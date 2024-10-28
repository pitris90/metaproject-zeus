import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('perun')
export class PerunGroupConsumer extends WorkerHost {
	async process(job: Job) {
		console.log(job);
		throw new Error('Method not implemented.');
	}
}
