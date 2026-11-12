;redcode-tiny
;name Turbulenz
;author Sascha Zapf
;strategy Paper
;assert 1

pStep1  equ      453
pStep2  equ      760

pBootdis1 equ 114

start
mov.i <578,540
mov.i <28,336
mov.i <96,636
mov.i <763,699
mov.i <683,491
mov.i <197,261
mov.i <734,186
mov.i <250,669
mov.i <144,57
mov.i <239,415

 
       spl 0,}0
        spl 1,<769
        mov.i   <pDat+1,{bootp1
bootp1  djn.f     pBootdis1,<621
pNext   spl   pStep1,  {pThis
        mov  }pThis, }pNext
        mov   pDat,  >pStep2
pThis   mov pNext+6, }pNext
        jmz.a @-3, *pThis
pDat    dat  <267,  <534

end start

