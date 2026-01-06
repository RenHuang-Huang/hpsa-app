export interface Record {
    id?: number;
    hosp_id: string;
    case_no: string;
    patient_name: string;
    id_no: string;
    birth_date: string;
    test_date: string;
    result: string;
    method: string;
    created_at?: string;
}

import { z } from 'zod';
import { formSchema } from './schema';

export type FormValues = z.infer<typeof formSchema>;
