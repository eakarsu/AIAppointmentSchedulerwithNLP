export function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = query.search || '';
  const sort = query.sort || '';
  const order = query.order === 'desc' ? 'DESC' : 'ASC';
  return { page, limit, offset, search, sort, order };
}

export function formatPaginatedResponse(rows, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}
