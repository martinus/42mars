;redcode-nano
;name The White Warp
;author Christian Schmidt
;strategy 
;assert 1

pStp   equ   55
pBmb1  equ   52
pBmb2  equ   40
pBmb3  equ   11

pGo    spl   #0,     <pBmb1+1
       mov   }pGo,   }pAwa
pAwa   spl   <pStp,  >-pBmb1
       mov   *pBmb2, >-pBmb1/3
       djn.f -1,     {pBmb3

       end
