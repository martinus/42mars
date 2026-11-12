;redcode-tiny
;name backdraft
;author Sascha Zapf
;strategy Stona & Impa
;assert 1

sDist    equ     624
iDist    equ     292
iAwa     equ     699

istep    equ     267

dStep    equ     754

xRef     equ     pGo


pGo     mov.i  <373    , 692
        mov.i  <258    , 226
        mov.i  <435    , 199


         mov     cBomb,                 xRef+sDist+1+dStep
         mov     imp,                   xRef+iDist+iAwa
ssptr    spl     1,                     dStart
isptr    spl     1,                     iStart+4
         mov     >ssptr,                {sBoo
         mov     <isptr,                {iBoo
sBoo     spl     xRef+sDist+4,          <312
iBoo     djn.f   xRef+iDist+4,          <33
cBomb    dat     >-1,                   >1
imp      mov.i   #istep,                *0
dStart   djn.f   -2,                    <174
         add.ab  {0,                    }0
         mov     dStep,                 715
iStart   spl     #0,                    <422
         add.a   #istep,                1
launch   spl     iStart+iAwa-(istep*4), <368
         djn.f   sDist-iDist-3,         <46

        end pGo

