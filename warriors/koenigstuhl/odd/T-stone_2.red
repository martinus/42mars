;redcode-tiny
;name T-stone 2
;author Christian Schmidt
;assert 1
;strategy stone
 
sDist    equ    588
sStep    equ    12
sHop     equ    603
sTime    equ    772
sGap     equ    10
 
 
pGo      spl    misc,          <406
         spl    1,             <248
         spl    1,             <754
         mov    <sBoo,         {sBoo
sBoo     jmp    pGo+sDist+5,   dStart+5
 
for 3
         dat    0,             0
rof
 
dStart   spl    #0,            <sHop+2
         mov    sGap-1,        {(sStep*sTime)+1
         mov    sGap-2,        @-1
         sub    #sStep,        -2
         djn.f  -3,            <sHop-2
 
 
for 1
         dat    0,             0
rof
 
misc     mov    <sBoo,         {sBoo
         mov    sBmb,          pGo+sDist+sGap
         mov    <323,          {116
         mov    <182,          {252
         mov    <357,          {70
sBmb     dat    <sHop+1,       >1
 
end