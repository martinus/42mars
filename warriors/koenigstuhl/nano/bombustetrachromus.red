;redcode-nano
;name Bombus Tetrachromus
;author S.Fernandes
;strategy mov mov spl mov mov
;assert CORESIZE==80

       org     loop
ptra    equ     loop-2
ptrb    equ     loop+24 ; 18
ptrc    equ     loop+38 ; 46

loop    mov     }ptrb       ,   <ptra
       mov     <ptra       ,   }ptrb
       spl     loop        ,   }1
       mov     {ptrc       ,   }ptrb
       mov.i   #1          ,   1
       end
