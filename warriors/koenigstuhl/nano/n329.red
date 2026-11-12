;redcode-nano
;name The Purple Ape
;author Christian Schmidt
;strategy 
;assert 1

pStp   equ   57
pBmb1  equ   67
pBmb2  equ   32
pBmb3  equ   74
pBmb4  equ   20
pBmb5  equ   53

pGo    spl   #0,     >pBmb1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >pBmb2
       mov   <pBmb3, >pBmb4
       djn.f -2,     {pBmb5

       end
