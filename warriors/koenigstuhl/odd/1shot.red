;redcode
;name 1SH0T
;author Jakub Kozisek
;strategy thanks John, your warriors RULEZ! :)
;       CORESIZE==800
;assert 1

step 	equ 	12
d 	equ 	(ptr-179)
s 	equ 	36

ptr	sub.b split,       #36+clear
        jmz.f -1,          @ptr
split	spl   #bomb-ptr,   <-step
clear   mov   *ptr,        >ptr
        djn.f clear,       <-11
bomb    dat   -ptr,        1-ptr

for   6
        dat   0,	   0
rof

make  z for   6
        mov   <(d+1)-(z*s),{d-((z+1)*s)
rof
        djn.f ptr+1,       <d

        end   make

