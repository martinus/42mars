;redcode-94x
;name Scythe CX 7
;author Steve Gunnell
;strategy Bit of Recon 2, bit of Kenshin,
;strategy bit of Racy Helper, bit of Perseus.
;assert CORESIZE==55440


START   equ  (12005+12005)
GAP     equ  ( 3+14 )
B       equ  (decoy+35944)
LAUNCH  equ  18642
PTR     equ  ( scan - GAP - 2 )
SAFE    equ  ( tail - loop + GAP + 1 )
STEP    equ  (25741+25741)


loop    sub    wipe, @s2
scan    sne.i  START-GAP, START  
        sub    wipe,  scan
clr     mov.i  wipe,  >PTR
    for 4
        mov.i  *clr,  >PTR
    rof
s2      sne.i *scan, @scan   ; check another pair
        jmp    loop,  scan
        slt.b  scan,  #SAFE    ; ignore self
here    mov.b  scan,  PTR
        jmn.b  loop,  scan
        jmp    loop, }clr
wipe    spl   #STEP, #STEP
    for 11
        DIV.AB #0 ,<0
    rof
    for 2
        SUB.A }0 ,}0
    rof
tail    dat   #0   , #0

boot  mov   >fire  , }fire
    for 4+5
      mov   >fire  , }fire
    rof
fire  spl   LAUNCH , loop
    for 11+2+6
      mov   >fire  , }fire
    rof
      sub.f  fire  , fire

S     equ   14

decoy nop   {B     , {B+S+2
I   for   (MAXLENGTH-CURLINE)
      mov.i {B+(S+3)*I , {(B+(S+3)*I+S+2)
  rof
end boot

