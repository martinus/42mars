;redcode-tiny
;name E-clear
;author Christian Schmidt
;strategy strange backward clear
;strategy strategy found in Martin Ankerl's
;strategy evolved warrior 'Evolver 80 x 500'
;assert 1

xOff1   EQU    773
xOff2   EQU    634
xSep1   EQU    63
xSep2   EQU    620

pGo  spl.i  #764,       {-4
     mov.i  #-4,        {ptr
     mov.i  {ptr,       {ptr
     djn.x  -1,         {3
     mov.i  <150,       {197
ptr  mov.a  <629,       {411
     spl    }-2,        <391

start
i for 12
     mov.i  >xOff1+(i*xSep1), {xOff2+(i*xSep2)
rof
     djn.f   pGo,       {159

     end     start

