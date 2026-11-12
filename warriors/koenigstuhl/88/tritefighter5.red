;redcode
;author Philip Thorne
;name TrItE Fighter 5
;strategy John Metcalf's Core War: Tournament Weekend 2025
;strategy
;strategy This is a variation on TrItE Fighter.
;strategy
;strategy Stone/Clear. Stone is Wayne Sheppard's No Ties Allowed
;strategy with 3 processes. Clear is David Moore's from PacMan
;strategy acts like a mod-5-ish stone initially as uses NTA's
;strategy gate as a ptr.
;strategy
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)
;assert (MAXCYCLES==80000) && (MAXLENGTH==100)
;assert (MINDISTANCE==100)
STEP equ 2234 ;NTA orig - not designed for -c 800000
BOFF equ 333
COFF equ ((Clear-Stone)+BOFF-2+STEP+cp)
BOOT equ (Stone-BOFF)
COOT equ (Clear-COFF)
CSTART equ (BOOT-(COOT+cp)+4000)
cp equ 12
D for 100-27-3
spl D+CURLINE, #1
rof
;No Ties Allowed stone
mov <-6000, 0 ;Nov25
Stone: mov <21, 1+STEP
sub 1, -1
jmp -2, <-STEP
;PacMan-ish continuous clear
Clear: mov dbmb+2, <Stone+2-STEP-BOFF+COFF
jmp -1, <-12
dbmb: dat <2667, #-cp
bust: mov <2663, <2663 ;DM anti-crashing-imp idea
boot: mov Stone+2, BOOT+2
mov Stone+1, <boot
mov Stone, <boot
mov Stone-1, <boot
mov bust, Stone+2-BOFF-STEP+4
cboot: mov Clear+1, COOT+1
mov Clear, <cboot
mov dbmb, COOT+4
mov #CSTART, COOT+cp
mov bust, COOT+cp+4
spl COOT, <cboot
start: spl 1
mov -1, 0
spl 1
jmp @route, <route
route: dat #0, #loc
jmp Stone+2-BOFF
jmp Stone+1-BOFF
jmp Stone-BOFF
jmp Stone+2-BOFF -1
jmp Stone-BOFF -0
loc: jmp Stone-1-BOFF -0
end boot

