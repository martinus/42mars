;redcode-nano
;name Orange Nanobug
;author Christian Schmidt
;strategy 
;assert 1

pStp   equ   20
pBmb1  equ   32
pBmb2  equ   56
pBmb3  equ   41
pBmb4  equ   6
pBmb5  equ   44

pGo    spl   #0,     >pBmb1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >pBmb2
       mov   <pBmb3, >pBmb4
       djn.f -1,     {pBmb5

       end
