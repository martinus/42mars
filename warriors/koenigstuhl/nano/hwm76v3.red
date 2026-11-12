;redcode-nano
;assert CORESIZE==80
;author hwm
;name 76v3
;strategy vampire v3

step 	equ -28
q1 	equ 5 
q2 	equ 25 
q3 	equ 55
q4 	equ 31 
org 	boot_clr

boot_clr    jmz.ba #     q1*2, {    -q1+1

trap        spl.a  #     q2, *     -q1
            mov.i  *     q3-3, {     -q1-1
ptr        mul.i  }     q3, {     q4
bmb         dat.b  {     q3+ptr, >     -q1

