;redcode
;name Test
;author Wayne Sheppard
;strategy NC with faster launch and smaller spiral
;assert 1
 
i equ icopy+500
nta equ icopy+200
 
mov x,nta+3
mov x-1,<-1
mov x-2,<-2
mov x-3,<-3
;Binary imp launch
SPL 8,<i+200
SPL 4,<i+2873
SPL 2,<i+5546
JMP i+0,<i+219
JMP i+2667,<i+2892
SPL 2,<i+5565
JMP i+5334,<i+238
JMP i+1,<i+2911
SPL 4,<i+5584
SPL 2,<i+257
JMP i+2668,<i+2930
JMP i+5335,<i+5603
mov icopy,i
spl nta,<i+276
spl nta,<i+286
spl nta,<i+296
jmp nta,<i+386
 
spl 0,<-2667
mov <-41,1+2234
add 1,-1
x jmp -2,<2234
icopy mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
mov 0,2667
 

