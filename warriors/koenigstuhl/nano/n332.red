;redcode-nano
;name Blue Ball Bingo
;author Christian Schmidt
;strategy silk with silk imps
;assert 1

pStp   equ   42
pBmb1  equ   58
pBmb2  equ   71
pBmb3  equ   61
pBmb4  equ   32
pBmb5  equ   1
pBmb6  equ   50

pGo    spl   #0,     >pBmb1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >pBmb2

       mov   >pBmb3, {pBmb4
       mov   >pBmb5, {pBmb6

       end
