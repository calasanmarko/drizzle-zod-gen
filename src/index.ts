import { Column, getTableColumns, getTableName, is, type Table } from 'drizzle-orm';
import { MySqlChar, MySqlVarBinary, MySqlVarChar } from 'drizzle-orm/mysql-core';
import { PgUUID, PgChar, PgVarchar } from 'drizzle-orm/pg-core';
import { SQLiteText } from 'drizzle-orm/sqlite-core';

export const createSelectSchema = <TTable extends Table>(table: TTable): string => createSchema(table, false);
export const createInsertSchema = <TTable extends Table>(table: TTable): string => createSchema(table, true);

const createSchema = <TTable extends Table>(table: TTable, insertSchema: boolean): string => {
    const columns = Object.entries(getTableColumns(table));
    const processed = columns.map(([name, column]) => `\t${name}: ${processColumn(column, insertSchema)}`);
    const interior = processed.join(",\n");

    return `export const ${getTableName(table)}${insertSchema ? 'Insert' : ''}Schema = z.object({\n${interior}\n});`;
};

const processColumn = (column: Column<any, object, object>, insertSchema: boolean): string => {
    let res = 'z.any()';
    if ("enumValues" in column && Array.isArray(column.enumValues) && column.enumValues.length > 0) {
        res = column.enumValues.length ? `z.enum(${column.enumValues.map(e => `"${e}"`).join(",")})` : 'z.string()';
    } else if (is(column, PgUUID)) res = 'z.string().uuid()';
    else if ("custom" === column.dataType) res = 'z.any()';
    else if ("json" === column.dataType) res = 'z.lazy(() => z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.array(f), z.record(f)]))';
    else if ("array" === column.dataType) res = 'z.array(processColumn((column as any).baseColumn))';
    else if ("number" === column.dataType) res = 'z.number()';
    else if ("bigint" === column.dataType) res = 'z.bigint()';
    else if ("boolean" === column.dataType) res = 'z.boolean()';
    else if ("date" === column.dataType) res = 'z.date()';
    else if ("string" === column.dataType) {
        const isMaxSupported = (
                is(column, PgChar)
                || is(column, PgVarchar)
                || is(column, MySqlVarChar)
                || is(column, MySqlVarBinary)
                || is(column, MySqlChar)
                || is(column, SQLiteText)
            ) && typeof column.length === "number";
        
        res = isMaxSupported ? 'z.string().max(column.length)' : 'z.string()';
    }

    if (!column.notNull) res += '.nullable()';
    if (insertSchema && column.notNull && column.hasDefault) res += '.optional()';

    return res;
}