// const calculatePagination = (options) => {
//     const page = Number(options.page || 1);
//     const limit = Number(options.limit || 10);
//     const skip = (page - 1) * limit;

//     const sortBy = options.sortBy || 'createdAt';
//     const sortOrder = options.sortOrder || 'desc';

//     return {
//       page,
//       limit,
//       skip,
//       sortBy,
//       sortOrder,
//     };
//   };

//    const paginationHelpers = {
//     calculatePagination,
//   };

//   module.exports = paginationHelpers

const calculatePagination = (options, config = {}) => {
  const page = Math.max(Number(options.page) || 1, 1);
  const limitRaw = Number(options.limit) || 10;
  const maxLimit = Math.max(Number(config.maxLimit) || 100, 1);
  const limit = Math.min(Math.max(limitRaw, 1), maxLimit);
  const skip = (page - 1) * limit;

  const sortBy = options.sortBy || "createdAt";
  const sortOrder =
    (options.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  return { page, limit, skip, sortBy, sortOrder };
};

const paginationHelpers = {
  calculatePagination,
};

module.exports = paginationHelpers;
