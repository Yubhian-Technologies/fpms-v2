import * as XLSX from "xlsx";

export const downloadDemoExcel = (filename: string, headers: string[]) => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create a worksheet with just the headers
  const data = [headers];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

  // Write the file
  XLSX.writeFile(workbook, filename);
};

// Headers for each form type
export const excelHeaders = {
  faculty: [
    "name",
    "email",
    "password",
    "designation",
    "experience",
    "hasPhd",
    "status",
  ],
  dean: ["name", "email", "password", "role", "designation", "hasPhd"],
  hod: ["name", "email", "password", "department", "designation", "hasPhd"],
};
