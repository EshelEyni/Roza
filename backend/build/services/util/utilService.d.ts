import { Model, Query, Document } from "mongoose";
import { ObjectId } from "mongodb";
import { ParsedReqQuery } from "../../types/app";
import { ISlateCustomElement } from "../../types/iTypes";
type AnyObject = {
    [key: string]: any;
};
declare const filterObj: (obj: AnyObject, ...allowedFields: string[]) => AnyObject;
declare class APIFeatures<T> {
    private query;
    private queryObj;
    constructor(query: Query<T[], T>, queryString: ParsedReqQuery);
    filter(): APIFeatures<T>;
    sort(): APIFeatures<T>;
    limitFields(): APIFeatures<T>;
    paginate(): APIFeatures<T>;
    getQuery(): Query<T[], T>;
}
declare function queryEntityExistsById<T extends Document>(model: Model<T>, query: {
    _id: ObjectId;
}): Promise<boolean>;
declare function isValidMongoId(id: string): boolean;
interface IdEntity {
    id: string | undefined;
    entityName: string;
}
declare function validateIds(...idEntities: IdEntity[]): void;
declare function getUniqueStringIds(ids: ObjectId[]): string[];
declare function shuffleArray<T>(array: T[]): T[];
declare function getIsraeliDate(): Date;
declare function getDefaultSlateElement(text?: string): ISlateCustomElement[];
export { AnyObject, APIFeatures, filterObj, queryEntityExistsById, isValidMongoId, validateIds, getUniqueStringIds, shuffleArray, getIsraeliDate, getDefaultSlateElement, };
