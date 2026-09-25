import { BaseNode } from '@tracereactive/types';
import { DescriptiveCategory } from '../../categories';
import * as aq from 'arquero';

export class CrossTabNode extends BaseNode {
    readonly category = DescriptiveCategory;
    readonly typeId = 'stats:crosstab';
    readonly displayName = 'Cross-Tabulation';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Table', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'rowColumn', label: 'Row Column', type: 'text' as const, defaultValue: '' },
        { name: 'colColumn', label: 'Col Column', type: 'text' as const, defaultValue: '' },
        { name: 'normalize', label: 'Normalize', type: 'select' as const, options: ['none', 'index', 'columns', 'all'], defaultValue: 'none' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const rowCol = properties['rowColumn'] as string;
        const colCol = properties['colColumn'] as string;
        const norm = properties['normalize'] as string;
        
        if (!rowCol || !colCol || !table.columnNames().includes(rowCol) || !table.columnNames().includes(colCol)) {
            return { Table: aq.table({}) };
        }
        
        try {
            const pivotTable = table
                .groupby(rowCol, colCol)
                .count({ as: 'count' })
                .pivot(colCol, { count: aq.op.sum('count') });
                
            if (norm === 'none') {
                return { Table: pivotTable };
            }
            
            let newTable = pivotTable;
            const valueCols = pivotTable.columnNames().filter(c => c !== rowCol);
            
            if (norm === 'all') {
                const totalSum = pivotTable.rollup(
                    Object.fromEntries(valueCols.map(c => [c, aq.op.sum(c)]))
                ).objects()[0];
                const grandTotal = Object.values(totalSum).reduce((a: any, b: any) => (a||0) + (b||0), 0) as number;
                
                const rollups = Object.fromEntries(valueCols.map(c => [c, aq.escape((d: any) => (d[c] || 0) / grandTotal)]));
                newTable = pivotTable.derive(rollups);
            } 
            else if (norm === 'index') {
                const rollups = Object.fromEntries(valueCols.map(c => [c, aq.escape((d: any) => {
                    const rowSum = valueCols.reduce((s, col) => s + (d[col] || 0), 0);
                    return rowSum === 0 ? 0 : (d[c] || 0) / rowSum;
                })]));
                newTable = pivotTable.derive(rollups);
            }
            else if (norm === 'columns') {
                const colSums = pivotTable.rollup(
                    Object.fromEntries(valueCols.map(c => [c, aq.op.sum(c)]))
                ).objects()[0];
                
                const rollups = Object.fromEntries(valueCols.map(c => [c, aq.escape((d: any) => {
                    const cSum = colSums[c] as number;
                    return cSum === 0 ? 0 : (d[c] || 0) / cSum;
                })]));
                newTable = pivotTable.derive(rollups);
            }
            
            return { Table: newTable };
        } catch(e) {
            console.error(e);
            return { Table: aq.table({}) };
        }
    }
}
