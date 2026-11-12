;redcode-DS
;name Happy New Year
;author Michal Janeczek
;assert 1

org decoy

step equ 4426
time equ 722

wipe mov bomb , }5045
loop mov bomb , >wipe
scan seq 6-time*step, -time*step
mov.b scan , wipe
add inc , scan
jmn loop , @loop
inc spl #step , step
mov @1 , }loop
djn -1 , <2
dat 13 , -11
spl #15 , -233

dat 0 , 0
dat 0 , 0
dat 0 , 0
dat 0 , 0

bomb spl #1 , 1

dloc equ (wipe-793)

decoy mov >dloc , 0
mov <dloc+1 , {dloc+3
mov {dloc+4 , <dloc+6
djn.f loop , <dloc+8

