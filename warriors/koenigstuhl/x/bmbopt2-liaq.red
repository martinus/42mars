;redcode-94x
;name Bomber AX 37
;author Steve Gunnell
;strategy More component testing - a bomber.
;assert 1

STEP   equ    24192
COUNT  equ    14107
GATE   equ    (dclr-9)
fDec   equ    (15258)
START  equ    43344

bomb   djn   { 35521 ,> 20119 
       dat.f  $0             ,$0
begin  add.ab #STEP         ,#-(START)
       jmz.f  begin         ,@begin
       slt.b  begin         ,#clr-begin+2
       mov.i  bomb          ,@begin
       jmn.ab begin         ,begin
dclr   spl    #0            ,0
dbmb   mov    clr           ,>GATE
for 0
       mov    clr           ,>GATE
rof
       djn.f  dbmb          ,>GATE
       dat.f  $0            ,$0
clr    dat    {38567 ,clr+3-GATE


      for   (MAXLENGTH-CURLINE-6)
      dat.f $0        ,$0
      rof

fBlur mov   {fDec    , {fDec+2   
      mov   {fDec+1  , {fDec+4
      mov   {fDec+5  , {fDec+7
      mov   {fDec+8  , {fDec+12
      mov   {fDec+9  , {fDec+14
      jmp   begin    , {fDec+15

      end   fBlur

