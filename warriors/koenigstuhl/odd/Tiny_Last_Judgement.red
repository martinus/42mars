;redcode-tiny
;name Tiny Last Judgement
;author Christian Schmidt
;assert 1
;strategy stone/imp
;kill T-Stone
 
sDist    equ    588
sStep    equ    12
sHop     equ    603
sTime    equ    772
sGap     equ    10
 
istep    equ     267
iDist    equ     239
iAwa     equ     428
 
pGo      mov    <sBoo,         {sBoo
         mov    sBmb,          pGo+sDist+sGap
         mov    imp,           pGo+iDist+iAwa
         spl    1,             <725
         spl    1,             <158
         mov    <sBoo,         {sBoo
         mov    <iBoo,         {iBoo
sBoo     spl    pGo+sDist+5,   dStart+5
iBoo     jmp    pGo+iDist+4,   iStart+4
 
 
iStart   spl    #istep,        <505
         add.f  -1,            1
launch   spl    iStart+iAwa-(istep*4), <82
         djn.f  sDist-iDist-3, <281
 
imp      mov.i  #istep,        *0
sBmb     dat    <sHop+1,       >1
 
dStart   spl    #0,            <sHop+2
         mov    sGap-1,        {(sStep*sTime)+1
         mov    sGap-2,        @-1
         sub    #sStep,        -2
         djn.f  -3,            <sHop-2
 
end pGo
