;redcode-tiny
;name Just Cream
;author LAchi
;strategy .66c oneshot -> clear
;assert 1
FIRST equ 34
WIDTH equ 8
STEP equ 16

s1
 jmn.f  bomb, @bptr
 add.f  #inc,  bptr
 jmz.f  s1,   *bptr
b
 djn.f  bomb,  bptr
for 10
dat 0,0
rof

inc
bptr
dat.f  $FIRST,  $FIRST+WIDTH
dat.f  $    10, *  -390
bomb
spl.f  #    20, $    -5
mov.i  $    -1, }    -3
mov.i  $    -2, }    -3
djn.a  $    -2, <    -3


end s1
