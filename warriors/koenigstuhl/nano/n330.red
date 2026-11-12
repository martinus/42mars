;redcode-nano
;name The Purple Sheep
;author Christian Schmidt
;strategy 
;assert 1

pStp   equ   52
pBmb1  equ   33
pBmb2  equ   29
pBmb3  equ   31
pBmb4  equ   36
pBmb5  equ   24

pGo    spl   #0,     >pBmb1
       mov   }pGo,   }pAwa
pAwa   spl   {pStp,  >pBmb2
       mov   <pBmb3, >pBmb4
       djn.f -2,     {pBmb5

       end
