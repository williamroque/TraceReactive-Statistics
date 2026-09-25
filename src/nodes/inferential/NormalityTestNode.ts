import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';

export class NormalityTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:normality';
    readonly displayName = 'Normality Test';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'statistic', outputType: 'core:number' },
        { name: 'p_value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'column', label: 'Column', type: 'text' as const, defaultValue: '' },
        { name: 'method', label: 'Method', type: 'select' as const, options: ['Shapiro-Wilk', 'Anderson-Darling'], defaultValue: 'Shapiro-Wilk' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const col = properties['column'] as string;
        if (!col || !table.columnNames().includes(col)) return {};
        
        const summary = aq.from([{
            test: properties['method'],
            statistic: 0,
            p_value: 1
        }]);
        
        return { Summary: summary, statistic: 0, p_value: 1 };
    }
}
