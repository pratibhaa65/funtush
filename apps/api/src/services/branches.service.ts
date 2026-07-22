import { db } from "@funtush/database";

interface CreateBranchPayload {
    name: string;
    address: string;
    phone: string;
    whatsapp?: string;
    managerStaffId?: string;
    isHeadOffice?: boolean;
}

interface UpdateBranchPayload {
    name?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    managerStaffId?: string;
    isHeadOffice?: boolean;
}

const BRANCH_LIMIT = {
    FREE: 1,
    SMALL: 1,
    MEDIUM: 3,
    LARGE: Infinity,
};

export const createBranchService = async (
    agencyUserId: string,
    data: CreateBranchPayload
) => {

    const agencyUser = await db.agencyUser.findUnique({
        where: {
            id: agencyUserId
        },
        select: {
            agencyId: true
        }
    });

    if (!agencyUser)
        throw new Error("Agency user not found");

    const agency = await db.agency.findUnique({
        where: {
            id: agencyUser.agencyId
        },
        select: {
            id: true,
            subscriptionTier: true
        }
    });

    if (!agency)
        throw new Error("Agency not found");

    const totalBranches = await db.branch.count({
        where: {
            agencyId: agency.id
        }
    });

    const limit =
        BRANCH_LIMIT[
        agency.subscriptionTier as keyof typeof BRANCH_LIMIT
        ];

    if (totalBranches >= limit) {
        throw new Error(
            `Your ${agency.subscriptionTier} plan allows only ${limit} branch(es).`
        );
    }


    if (data.managerStaffId) {
        const manager = await db.agencyStaff.findFirst({
            where: {
                id: data.managerStaffId,
                agencyId: agency.id,
                isActive: true
            }
        });

        if (!manager)
            throw new Error("Manager does not belong to your agency.");
    }

    if (data.isHeadOffice === true) {
        const existing = await db.branch.findFirst({
            where: {
                agencyId: agency.id,
                isHeadOffice: true
            }
        });

        if (existing)
            throw new Error("Head office already exists.");
    }

    return await db.branch.create({
        data: {
            agencyId: agency.id,
            name: data.name,
            address: data.address,
            phone: data.phone,
            whatsapp: data.whatsapp,
            managerStaffId: data.managerStaffId,
            isHeadOffice: data.isHeadOffice ?? false
        }
    });

}

export const updateBranchService = async (
    agencyUserId: string,
    branchId: string,
    data: UpdateBranchPayload
) => {
    const agencyUser = await db.agencyUser.findUnique({
        where: {
            id: agencyUserId
        },
        select: {
            agencyId: true
        }
    });

    if (!agencyUser)
        throw new Error("Agency user not found");

    const branch = await db.branch.findFirst({
        where: {
            id: branchId,
            agencyId: agencyUser.agencyId
        }
    });

    if (!branch)
        throw new Error("Branch not found");

    if (data.managerStaffId) {
        const manager = await db.agencyStaff.findFirst({
            where: {
                id: data.managerStaffId,
                agencyId: agencyUser.agencyId,
                isActive: true
            }
        });

        if (!manager)
            throw new Error("Invalid manager");
    }

    if (data.isHeadOffice === true) {
        const existing = await db.branch.findFirst({
            where: {
                agencyId: agencyUser.agencyId,
                isHeadOffice: true,
                NOT: {
                    id: branch.id
                }
            }
        });

        if (existing)
            throw new Error("Another head office already exists.");
    }

    return await db.branch.update({
        where: {
            id: branch.id
        },
        data: {
            ...data
        }
    });
}

export const getBranchesService = async (
    agencyUserId: string
) => {

    const agencyUser = await db.agencyUser.findUnique({
        where: {
            id: agencyUserId
        },
        select: {
            agencyId: true
        }
    });

    if (!agencyUser)
        throw new Error("Agency user not found");

    return await db.branch.findMany({

        where: {
            agencyId: agencyUser.agencyId
        },

        include: {
            managerStaff: {
                select: {
                    id: true,
                    fullName: true,
                    email: true
                }
            }
        },

        orderBy: {
            createdAt: "asc"
        }
    });
}