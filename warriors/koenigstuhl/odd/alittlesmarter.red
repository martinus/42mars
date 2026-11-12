;redcode
;name A little smarter
;author John Morahan
;strategy adaptive random switcher
;assert 1

max equ 800

org go

gate: jmp #0,<-3

imp: mov.i #4,1

N for 5
dat 0,0
rof

ptr equ clear-3
clear: mov bmb,}ptr ;<-- must start here
mov bmb,}ptr
jmp -2
bmb: dat 7,0

go ldp.ab #0, #0 ; L/W/T

;- first round: initialize probability table
slt.b go, #3
jmp first

;- load random seed
rand ldp.ab #1, #0

;- update random seed
mul.ab #621, rand
add.ab #1, rand
mod.ab #max, rand

;- store random seed
stp.b rand, #1

;- load previous strategy
ldp.a #5, last

;- load previous probabilities
ldp.a #2, first
ldp.a #3, (first+1)
ldp.a #4, (first+2)

;- find probability of previous strategy in probability table
last add.ab #0, #first

;- update probabilities based on previous result
jmz.b lost, go
djn.b select, go
jmp won

;- select a strategy based on current probabilities
select
mov.a #2, table
sub.ab (first+2), #max
slt.b -1, rand
mov.a #1, table
slt.ab first, rand
mov.a #0, table

;- store current strategy
stp.ab table, #5

;- store current probabilities
first stp.ab #(max/3), #2
stp.ab #(max/3), #3
stp.ab #(max/3), #4

;- go to the selected strategy
table jmp @0, imp
dat 0, clear
dat 0, gate

;- update probabilities if last strategy won
won
slt.a #1, first
jmp select
slt.a #1, first+1
jmp select
slt.a #1, first+2
jmp select
nop {first, {first+1
nop {first, {first+1
nop {first+2, {first+2
add.a #6, @last
jmp select

;- update probabilities if last strategy lost
lost
slt.a #1, @last ; ensure @last > 1
jmp select
nop }first, }first+1
nop }first+2
sub.a #3, @last
jmp select

end
 
      
 
   
    
