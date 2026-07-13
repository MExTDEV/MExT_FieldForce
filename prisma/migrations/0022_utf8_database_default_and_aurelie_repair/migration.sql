ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `User`
SET `firstName` = CONVERT(0x417572C3A96C6965 USING utf8mb4)
WHERE `email` = 'aurelie.milet@mext.be'
  AND `lastName` = 'Milet'
  AND HEX(`firstName`) IN (
    '417572EFBFBD6C6965',
    '417572C383C2A96C6965',
    '417572C3AFC2BFC2BD6C6965'
  );
