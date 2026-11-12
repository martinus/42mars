;redcode-94
;author Compudemon
;name death 2
;assert 1

pin 1234

first  equ search

;cookies
k1 equ 3923
k2 equ 1754
k1p equ 44

;constants for warriors
bjs EQU (CORESIZE/2)
min EQU (CORESIZE/800)
fst EQU (min*389)
step EQU (min*73)
dr1 equ (1100)
dr2 equ (1200)
dr3 equ (1300)
dr4 equ (1400)
drlen equ (14)
tosser equ (tossed-drlen-1)

begin ldp       #0, #0
  add.ba begin, jv
jv jmp      @sv, first

sv dat 0, loss
 dat 0, win
 dat 0, tie

loss stp  #k1, #k1p ; in order to brain wash you need to hit here with stp
                    ; #k2, #k1p in first 4 cycles
 ldp #k1p, #0       ; even if you do it will fix it next round
 sne.b -1, #k2
die dat 0

 jmp  tie, 0        ; go to strategy to do on loss

win     stp  #k2, #k1p
        stp  #k2, #k1p

 jmp  tie, 0        ; go to strategy to do on win


tie                 ; the tie strategy

loop for drlen
 mov }mdrg,>mdrg
rof

 mov.f mdrg+1,mdrg
tossed jmp   tosser,}-1

ener

spl dr1+ener+ofst, 1
spl dr2+ener+ofst, 1
spl dr3+ener+ofst, 1
jmp dr4+ener+ofst, 1

mdrg dat stdr,dr1+ener
dat stdr-mdrg,dr2+ener-mdrg
dat stdr-mdrg,dr3+ener-mdrg
dat stdr-mdrg,dr4+ener-mdrg
dat tkil-mdrg,tosser+1-mdrg
tkil jmp ener-tosser-1, 1

ofst equ (start-tmp)
stdr equ tmp

tmp DAT sce+1,sce+1+fst
top MOV.A #sce+2,tmp
ADD #step+(sce-tmp),tmp
start MOV {tmp,<tmp
MOV {tmp,<tmp
JMN.A start,*tmp
SPL top,>tmp
JMP >tmp
for 5
DAT 1,1
rof
sce DAT 1,1

;borrowed from socrates by Kurt Franke
;; - - - - - - - - - special first round routine - - - - - - - - - - - - -

;; Determine who moved first without pspace
;;  1st version waits till timeout and second kills itself

search  jmz.f   search, {count          ;; find the other copy

count   sne.i   #-100, {count           ;; skip the next line if we are #2
        jmp     $0, {count

;; - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

end begin


