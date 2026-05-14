
const db = require("../../../models");
const paginationHelpers = require("../../../helpers/paginationHelper");
const { Op, where } = require("sequelize");
const { error } = require("winston");
const ApiError = require("../../../error/ApiError");
const Sale = db.sale;
const Accounting = db.accounting;
const Buyer = db.buyer;
const User = db.user;
const Product = db.product;

const insertIntoDB = async (data) => {
  
    const { transaction_date, quantity, rate, paid_amount, remarks, buyerId, productId, userId } = data;

    // Retrieve the product to get the current stock
    const product = await Product.findOne({
      where: { Id: productId }
    });

    const buyer = await Buyer.findOne({
      where: { Id: buyerId }
    });

    

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    const price = parseFloat(rate * quantity);
    const due_amount = parseFloat(price - paid_amount);

    // Create the sale data
    const saleData = {
      product_name: product.name,
      buyer_name:buyer.name,
      transaction_date: new Date(transaction_date),
      quantity,
      rate,
      price,
      paid_amount,
      due_amount,
      remarks,
      buyerId,
      productId,
      userId
    };

    // Update the product stock after sale
    if (parseFloat(product.stock) < parseFloat(quantity)) {
      throw new ApiError(400,'Insufficient stock');
    }

    const updatedStock = product.stock - parseFloat(quantity);

    await Product.update(
      { stock: updatedStock },
      {
        where: { Id: productId } // Ensure this matches your model definition
      }
    );

    // Insert the sale record into the Sale table
    const result = await Sale.create(saleData);

    // Calculate the total transaction amount for the accounting table
    const totalTransactionAmount = Number(result.paid_amount) + Number(result.due_amount);

    // Prepare accounting data
    const accountingData = {
      transaction_date: result.transaction_date,
      transaction_type: 'Sale',
      transaction_amount: totalTransactionAmount,
      remarks: result.remarks,
      saleId: result.Id,
    };

    // Insert the accounting data
    await Accounting.create(accountingData);

    // Calculate the total due amount of the buyer and update in the Buyer table
    const saleDueAmount = await Sale.findAll({
      where: { buyerId: result.buyerId }
    });

    let totalBuyerDueAmount = 0;
    saleDueAmount.forEach((sale) => {
      totalBuyerDueAmount += parseFloat(sale.due_amount);
    });

    // Update the Buyer's total due amount with a where clause
    await Buyer.update(
      { due_amount: totalBuyerDueAmount },  // Corrected update object
      { where: { Id: buyerId } }            // Added `where` clause to specify the buyer
    );

    return result; // Return the newly created sale
};





const getAllFromDB = async (filters, options) => {

    const { page, limit, skip } = paginationHelpers.calculatePagination(options);
    const { startDate, endDate, buyerId } = filters;

    console.log(filters);

    const whereConditions = {};

    // Filter by date range if both startDate and endDate are provided
    if (startDate && endDate) {
      whereConditions.transaction_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // Filter by buyerId if provided
    if (buyerId) {
      whereConditions.buyerId = buyerId;  // Ensure this matches the actual column name
    }

    const result = await Sale.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order: options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder]]
        : [['createdAt', 'DESC']],
       
    });

    const total = await Sale.count({
      where: whereConditions,
    });

    return {
      meta: {
        total,
        page,
        limit
      },
      data: result
    };
  
};



const getDataById = async (id) => {
  
  const result = await Sale.findOne({
    where:{
      Id:id
    }
  })

  return result
};


const deleteIdFromDB = async (id) => {
 

  // Fetch the existing purchase record to get the current quantity before updating
  const existingSale = await Sale.findOne({ where: { Id: id } });
  if (!existingSale) {
    throw new ApiError(404, 'Sale record not found');
  }

   // Adjust the stock in the Product table
 const product = await Product.findOne({ where: { Id: existingSale.productId } });
 if (!product) {
   throw new ApiError(404, 'Product not found');
 }

 const updatedStock = Number(product.stock) + Number(existingSale.quantity)
 await Product.update({ stock: updatedStock }, { where: { Id: product.Id } });

    // If Sale record is deleted, proceed to delete the related accounting record
    const accountingResult = await Accounting.destroy({
      where: {
        saleId: existingSale.Id,
      },
    });

    // Delete the sale record first
    const saleResult = await Sale.destroy({
      where: {
        Id: id, // Ensure the column name matches the model definition
      },
    });


    const saleDueAmount =  await Sale.findAll({
      where:{
        buyerId: existingSale.buyerId
      }
    })
    
    
    let totalBuyerDueAmount = 0
    
    saleDueAmount.forEach(sale => {
      totalBuyerDueAmount += sale.due_amount
    });
    
    
    await Buyer.update(totalBuyerDueAmount,{
      where:{
        Id: existingSale.buyerId
      }
    })

    
    return { accountingResult, saleResult };
  
};



const updateOneFromDB = async (id, payload) => {
  const { buyer_name, transaction_date, quantity, rate, paid_amount, remarks, buyerId, productId } = payload;

  // Fetch the existing sale record to get the current quantity before updating
  const existingSale = await Sale.findOne({ where: { Id: id } });
  if (!existingSale) {
    throw new ApiError(404, 'Sale record not found');
  }
  

  // Calculate the change in quantity (difference)
  const quantityDifference = parseFloat(quantity) - parseFloat(existingSale.quantity);

  // Get product name for saleData
  const saleName = await Product.findOne({ where: { Id: productId } });
  if (!saleName) {
    throw new ApiError(404, 'Product not found');
  }


  const buyer = await Buyer.findOne({
      where: { Id: buyerId }
    });

  const price = parseFloat(rate * quantity);
  const due_amount = parseFloat(price - paid_amount);

  const saleData = {
    product_name: saleName.name,
    buyer_name:buyer.name,
    transaction_date: new Date(transaction_date),
    quantity,
    rate,
    price,
    paid_amount,
    due_amount,
    remarks,
    productId,
    buyerId,
  };

  // Adjust the stock in the Product table
  const product = await Product.findOne({ where: { Id: productId } });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (parseFloat(product.stock) < parseFloat(quantityDifference)) {
    throw new ApiError(400, 'Insufficient stock');
  }

  const updatedStock = parseFloat(product.stock) - quantityDifference;
  await Product.update({ stock: updatedStock }, { where: { Id: productId } });

  // Update the Sale record
  const result = await Sale.update(saleData, { where: { Id: id } });

  // Calculate the total transaction amount
  const totalTransactionAmount = Number(paid_amount) + Number(due_amount);

  // Prepare accounting data
  const accountingData = {
    transaction_date: new Date(transaction_date),
    transaction_type: 'Sale',
    transaction_amount: totalTransactionAmount,
    remarks,
    saleId: id, // Assuming this is the buyer's ID
  };

  // Update the Accounting table
  await Accounting.update(accountingData, { where: { saleId: id } });

  // Retrieve all sales for the buyer to calculate total due amount
  const salesDueAmount = await Sale.findAll({
    where: { buyerId: buyerId }
  });

  let totalBuyerDueAmount = 0;
  salesDueAmount.forEach((sale) => {
    totalBuyerDueAmount += parseFloat(sale.due_amount);
  });

  // Update the Buyer's total due amount
  await Buyer.update(
    { due_amount: totalBuyerDueAmount },  // Corrected update object
    { where: { Id: buyerId } }            // Added `where` clause to specify which buyer
  );

  return result;
};



const getAllFromDBWithoutQuery = async () => {
 
  const result = await Sale.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  })

  return result

};

 const SaleService = { 
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery

}

module.exports = SaleService;
