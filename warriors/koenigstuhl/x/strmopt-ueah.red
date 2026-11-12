;redcode-94x
;name Mournblade A 8
;author Steve Gunnell
;strategy Extended the launcher to 64 processes and replaced
;strategy the stone with dual carbonites.
;assert CORESIZE == 55440

d      equ 29179
BMB    equ (cmov1 + 21684)
GATE   equ (ctop1 - 196)
DECOY  equ (ctop1 - 1910)
START1 equ (36214)
START2 equ (16377)

ctop1  spl    ctop2 ,#0
       spl    #0    ,#0
cmov1  mov.i  BMB   ,<START1
cadd1  add.ab {0    ,}0
       djn.f  cmov1 ,<GATE

       for 15
       dat.f  $0   ,$0
       rof

ctop2  spl    ctop1 ,#0
       spl    #0    ,#0
cmov2  mov.i  BMB   ,{START2
       add.ab {0    ,}0
       djn.f  cmov2 ,<GATE

       for MAXLENGTH-CURLINE-70
       dat.f  $0   ,$0
       rof

i      mov.i #d   ,*0
bomb   dat <1     ,<GATE+cadd1
start: spl ctop1  ,<DECOY
       mov bomb   ,*cmov1
       spl 1      ,<DECOY+1
       spl pt2    ,<DECOY+2
       spl 16     ,<DECOY+3
       spl 8      ,<DECOY+4
       spl 4      ,<DECOY+5
       spl 2      ,<DECOY+6
       jmp i      ,<DECOY+7
       jmp i+d*1  ,<DECOY+8
       spl 2      ,<DECOY+9
       jmp i+d*2  ,<DECOY+10
       jmp i+d*3  ,<DECOY+11
       spl 4      ,<DECOY+12
       spl 2      ,<DECOY+13
       jmp i+d*4  ,<DECOY+14
       jmp i+d*5  ,<DECOY+15
       spl 2      ,<DECOY+16
       jmp i+d*6  ,<DECOY+17
       jmp i+d*7  ,<DECOY+18
       spl 8      ,<DECOY+19
       spl 4      ,<DECOY+20
       spl 2      ,<DECOY+21
       jmp i+d*8  ,<DECOY+22
       jmp i+d*9  ,<DECOY+23
       spl 2      ,<DECOY+24
       jmp i+d*10 ,<DECOY+25
       jmp i+d*11 ,<DECOY+26
       spl 4      ,<DECOY+27
       spl 2      ,<DECOY+28
       jmp i+d*12 ,<DECOY+29
       jmp i+d*13 ,<DECOY+30
       spl 2      ,<DECOY+31
       jmp i+d*14 ,<DECOY+32
       jmp i+d*15 ,<DECOY+33
pt2    spl 16     ,<DECOY+34
       spl 8      ,<DECOY+35
       spl 4      ,<DECOY+36
       spl 2      ,<DECOY+37
       jmp i+d*16 ,<DECOY+38
       jmp i+d*17 ,<DECOY+39
       spl 2      ,<DECOY+40
       jmp i+d*18 ,<DECOY+41
       jmp i+d*19 ,<DECOY+42
       spl 4      ,<DECOY+43
       spl 2      ,<DECOY+44
       jmp i+d*20 ,<DECOY+45
       jmp i+d*21 ,<DECOY+46
       spl 2      ,<DECOY+47
       jmp i+d*22 ,<DECOY+48
       jmp i+d*23 ,<DECOY+49
       spl 8      ,<DECOY+50
       spl 4      ,<DECOY+51
       spl 2      ,<DECOY+52
       jmp i+d*24 ,<DECOY+53
       jmp i+d*25 ,<DECOY+54
       spl 2      ,<DECOY+55
       jmp i+d*26 ,<DECOY+56
       jmp i+d*27 ,<DECOY+57
       spl 4      ,<DECOY+58
       spl 2      ,<DECOY+59
       jmp i+d*28 ,<DECOY+60
       jmp i+d*29 ,<DECOY+61
       spl 2      ,<DECOY+62
       jmp i+d*30 ,<DECOY+63
       jmp i+d*31 ,<DECOY+64


end start

