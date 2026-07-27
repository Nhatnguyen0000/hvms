/**
 * Chuyển đổi số tiền thành chữ Tiếng Việt chuẩn dùng trong in Biên Lai / Hóa Đơn Hiếu Vũ
 * Ví dụ: 2,400,000 -> "Hai triệu bốn trăm nghìn đồng"
 */

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readThreeDigits(threeDigits: number, showZeroHundred: boolean): string {
  let hundred = Math.floor(threeDigits / 100);
  let ten = Math.floor((threeDigits % 100) / 10);
  let unit = threeDigits % 10;
  let res = "";

  if (hundred > 0 || showZeroHundred) {
    res += DIGITS[hundred] + " trăm ";
  }

  if (ten > 1) {
    res += DIGITS[ten] + " mươi ";
    if (unit === 1) {
      res += "mốt";
    } else if (unit === 5) {
      res += "năm";
    } else if (unit > 0) {
      res += DIGITS[unit];
    }
  } else if (ten === 1) {
    res += "mười ";
    if (unit === 1) {
      res += "một";
    } else if (unit === 5) {
      res += "lăm";
    } else if (unit > 0) {
      res += DIGITS[unit];
    }
  } else {
    // ten === 0
    if ((hundred > 0 || showZeroHundred) && unit > 0) {
      res += "linh ";
    }
    if (unit > 0) {
      if (unit === 5 && (hundred > 0 || showZeroHundred)) {
        res += "năm";
      } else {
        res += DIGITS[unit];
      }
    }
  }

  return res.trim();
}

export function numberToVietnameseWords(amount: number): string {
  if (amount === 0) return "Không đồng";
  if (amount < 0) return "Âm " + numberToVietnameseWords(Math.abs(amount));

  let strNum = Math.floor(amount).toString();
  let groups: number[] = [];

  while (strNum.length > 0) {
    let chunk = strNum.slice(-3);
    groups.unshift(parseInt(chunk, 10));
    strNum = strNum.slice(0, -3);
  }

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let parts: string[] = [];
  let numGroups = groups.length;

  for (let i = 0; i < numGroups; i++) {
    let groupVal = groups[i];
    let unitIndex = numGroups - 1 - i;

    if (groupVal > 0) {
      let showZeroHundred = i > 0;
      let text = readThreeDigits(groupVal, showZeroHundred);
      if (units[unitIndex]) {
        text += " " + units[unitIndex];
      }
      parts.push(text.trim());
    }
  }

  if (parts.length === 0) return "Không đồng";

  let result = parts.join(" ").trim();
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
  return result.replace(/\s+/g, " ");
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}
