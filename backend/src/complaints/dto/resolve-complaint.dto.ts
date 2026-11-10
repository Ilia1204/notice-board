import { ComplaintStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class ResolveComplaintDto {
  @IsIn([ComplaintStatus.ACCEPTED, ComplaintStatus.DISMISSED], {
    message: 'Выберите решение по жалобе',
  })
  status!: ComplaintStatus;
}
