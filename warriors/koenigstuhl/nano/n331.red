;redcode-nano
;name Yellow Butterfly
;author Christian Schmidt
;strategy silk with nano silk imps
;assert 1

pStp   equ   42
pBmb1  equ   31
pBmb2  equ   59
pBmb3  equ   40
pBmb4  equ   16
pBmb5  equ   43
pBmb6  equ   2

pGo    spl   #0,     >pBmb1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >pBmb2

       mov   #pBmb3, }pBmb4
       mov   #pBmb5, }pBmb6

       end
