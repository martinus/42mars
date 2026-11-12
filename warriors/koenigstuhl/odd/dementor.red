;redcode-rf23
;name Dementor
;author Christian Schmidt
;assert 1
;strategy p-warrior
;strategy switching between:
;strategy 1. imp/imp-gate
;strategy 2. imp-gate/coreclear-hopper
;strategy 3. simple LP paper

gate  equ  (look-140)

die   dat -10, -10

for 5
dat 0, 0
rof

iGo   mov.i imp, *1
      spl imp+10000
      jmp #0, <-30

for 4
dat 0, 0
rof

look  jmz.f  #0,  gate
      nop  >gate+5, >gate+6
      nop  >gate+11, >gate+12
      nop  >gate+17, >gate+18
      nop  >gate+23, >gate+24
      nop  >gate+29, >gate+50
      nop  >gate+61, >gate+62
      nop  >gate+73, >gate+74
      nop  >gate+85, >gate+86
      nop  >gate+97, >gate+98
      jmp  look+1,   >gate+109

for 10
dat 0, 0
rof

pStep1 equ 8171
pStep2 equ 7013

sGo     spl     p2
p1      mov     #b1,             #0
        mov     <p1,            <j1
        jmn     -1,             @-2
        spl     p1,             <pStep2
j1      jmp.b   @0,             pStep1
b1      dat     0,              0

for 10
dat 0, 0
rof

pGo   spl  look
      spl  1
      mov.i -1, 0
      mov.i -1, 0
      mov.i -1, 0

pStep equ (21*9)+1

s1    nop  0,   }0
      nop  }-1, }-1

       mov.i  >s2+1, @s2+1
  for 20
      mov.i  s2+1, >s2+1
  rof

      mov.i  {s1, {s2
      mov.i  {s1, {s2
      mov.i  {s1, {s2
s2    jmp    pStep
   
for 5
dat 0, 0
rof

STORE equ 256 ; state storage location

w0 equ pGo
w1 equ iGo
w2 equ sGo
w3 equ sGo

think ldp.a #0, in
 ldp.a #STORE, table
 mod.ba *in, table
 stp.b *table, #STORE
table jmp }0, 226 ; =(22*10)+ 6=(25* 9)+ 1=(20*11)+ 6
 dat w0, 650 ; =(65*10)+ 0=(72* 9)+ 2=(59*11)+ 1
 dat w0, 101 ; =(10*10)+ 1=(11* 9)+ 2=( 9*11)+ 2
 dat w1, 886 ; =(88*10)+ 6=(98* 9)+ 4=(80*11)+ 6
 dat w1, 653 ; =(65*10)+ 3=(72* 9)+ 5=(59*11)+ 4
 dat w1, 104 ; =(10*10)+ 4=(11* 9)+ 5=( 9*11)+ 5
 dat w2, 889 ; =(88*10)+ 9=(98* 9)+ 7=(80*11)+ 9
 dat w2, 656 ; =(65*10)+ 6=(72* 9)+ 8=(59*11)+ 7
 dat w2, 107 ; =(10*10)+ 7=(11* 9)+ 8=( 9*11)+ 8
 dat w3, 630 ; =(63*10)+ 0=(70* 9)+ 0=(57*11)+ 3

 dat w0, 226 ; =(22*10)+ 0=(25* 9)+ 1=(20*11)+ 6

in dat 0, 10 
dat 2, 9
dat 2, 11



for 353-18           ; was 853 [CCB]
dat 0, 0
rof

p2      mov     #b2,             #0
        mov     <p2,            <j2
        jmn     -1,             @-2
        spl     p2,             <pStep2
j2      jmp.b   @0,             pStep1
b2      dat     0,              0


imp  mov.i #0, 1

end think
